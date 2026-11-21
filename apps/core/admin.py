"""
Core Django admin registration.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Daycare, Student, Employee, Classroom

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'daycare')
    list_filter = ('is_staff', 'is_superuser', 'status', 'daycare')
    search_fields = ('username', 'first_name', 'last_name', 'email')

@admin.register(Daycare)
class DaycareAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'phone', 'city', 'status')
    search_fields = ('name', 'email', 'city')

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'daycare', 'status')
    search_fields = ('first_name', 'last_name')
    list_filter = ('status', 'daycare')

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'daycare', 'role', 'status')
    search_fields = ('first_name', 'last_name', 'email')
    list_filter = ('status', 'daycare')

@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ('room_name', 'daycare', 'capacity', 'program')
    search_fields = ('room_name',)
    list_filter = ('daycare',)
