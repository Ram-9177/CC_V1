import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Smooth scroll to top when path changes
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant', // Instant scroll is better for route changes than smooth
    });
  }, [pathname]);

  return null;
}
