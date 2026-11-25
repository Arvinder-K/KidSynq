from django.contrib import admin
from core.models import Classroom, Program

try:
    @admin.register(Classroom)
    class ClassroomsRoomAdmin(admin.ModelAdmin):
        list_display = ('room_name', 'daycare', 'capacity', 'program')
except admin.sites.AlreadyRegistered:
    pass

try:
    @admin.register(Program)
    class ClassroomsProgramAdmin(admin.ModelAdmin):
        list_display = ('name', 'daycare')
except admin.sites.AlreadyRegistered:
    pass

