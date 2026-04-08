from django.contrib import admin
from .models import Company, JobPosting, Application, Offer

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ['name', 'industry', 'contact_email', 'college']
    search_fields = ['name', 'industry']
    list_filter = ['college', 'industry']

@admin.register(JobPosting)
class JobPostingAdmin(admin.ModelAdmin):
    list_display = ['title', 'company', 'package', 'status', 'application_deadline']
    list_filter = ['status', 'company']
    search_fields = ['title', 'company__name']

@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ['student', 'job', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['student__username', 'job__title']

@admin.register(Offer)
class OfferAdmin(admin.ModelAdmin):
    list_display = ['student', 'job', 'company', 'package', 'accepted', 'joined']
    list_filter = ['accepted', 'joined', 'company']
