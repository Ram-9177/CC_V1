import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '@/pages/auth/LoginPage'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/store'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

const renderLoginPage = () => {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
    useAuthStore.getState().logout()
  })

  it('shows field-level validation errors for empty submit', async () => {
    const user = userEvent.setup()
    const mockedPost = vi.mocked(api.post)

    renderLoginPage()

    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Login identifier is required')).toBeInTheDocument()
    expect(await screen.findByText('Password is required')).toBeInTheDocument()
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('logs in and navigates to role home on success', async () => {
    const user = userEvent.setup()
    const mockedPost = vi.mocked(api.post)

    mockedPost.mockResolvedValue({
      data: {
        user: {
          id: 1,
          username: 'student1',
          name: 'Student One',
          role: 'student',
          is_active: true,
        },
        tokens: {
          access: 'access-token-123',
        },
        password_change_required: false,
      },
    })

    renderLoginPage()

    await user.type(screen.getByLabelText('Username / Email / ID'), '23B91A1234')
    await user.type(screen.getByPlaceholderText('********'), 'secret123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith('/auth/login/', {
        hall_ticket: '23B91A1234',
        password: 'secret123',
      })
    })

    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().token).toBe('access-token-123')
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('shows disabled access panel for COLLEGE_DISABLED login response', async () => {
    const user = userEvent.setup()
    const mockedPost = vi.mocked(api.post)

    mockedPost.mockRejectedValue({
      response: {
        data: {
          code: 'COLLEGE_DISABLED',
          detail: 'College is temporarily disconnected.',
          college_name: 'SMG Campus',
        },
      },
    })

    renderLoginPage()

    await user.type(screen.getByLabelText('Username / Email / ID'), '23B91A1234')
    await user.type(screen.getByPlaceholderText('********'), 'secret123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('College Suspended')).toBeInTheDocument()
    expect(screen.getByText('SMG Campus')).toBeInTheDocument()
  })
})
