from django.contrib import admin
from core.models import Student

try:
    @admin.register(Student)
    class ChildrenStudentAdmin(admin.ModelAdmin):
        list_display = ('first_name', 'last_name', 'daycare', 'status')
        search_fields = ('first_name', 'last_name')
        list_filter = ('status', 'daycare')
except admin.sites.AlreadyRegistered:
    pass
