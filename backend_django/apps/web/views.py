from django.shortcuts import render
from django.views.decorators.cache import never_cache


@never_cache
def dashboard(request):
    return render(request, 'web/dashboard.html')


@never_cache
def login_view(request):
    return render(request, 'web/login.html')


@never_cache
def register_view(request):
    return render(request, 'web/register.html')


@never_cache
def attendance(request):
    return render(request, 'web/attendance.html')


@never_cache
def colleges(request):
    return render(request, 'web/colleges.html')


@never_cache
def events(request):
    return render(request, 'web/events.html')


@never_cache
def gate_passes(request):
    return render(request, 'web/gate_passes.html')


@never_cache
def gate_scans(request):
    return render(request, 'web/gate_scans.html')


@never_cache
def meals(request):
    return render(request, 'web/meals.html')


@never_cache
def messages(request):
    return render(request, 'web/messages.html')


@never_cache
def metrics(request):
    return render(request, 'web/metrics.html')


@never_cache
def notices(request):
    return render(request, 'web/notices.html')


@never_cache
def notifications(request):
    return render(request, 'web/notifications.html')


@never_cache
def reports(request):
    return render(request, 'web/reports.html')


@never_cache
def rooms(request):
    return render(request, 'web/rooms.html')


@never_cache
def users(request):
    return render(request, 'web/users.html')


@never_cache
def profile(request):
    return render(request, 'web/profile.html')
