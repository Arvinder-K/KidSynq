from django.contrib import admin
from core.models import Announcement, ConsentForm

try:
    @admin.register(Announcement)
    class AnnouncementAdmin(admin.ModelAdmin):
        list_display = ('title', 'daycare', 'sender', 'status', 'created_at')
        list_filter = ('status', 'created_at')
        search_fields = ('title', 'content')
except admin.sites.AlreadyRegistered:
    pass

try:
    @admin.register(ConsentForm)
    class ConsentFormAdmin(admin.ModelAdmin):
        list_display = ('title', 'daycare', 'form_type', 'requires_signature', 'status')
        list_filter = ('requires_signature', 'status')
        search_fields = ('title', 'description', 'content')
except admin.sites.AlreadyRegistered:
    pass
