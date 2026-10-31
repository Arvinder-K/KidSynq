"""
Schedule and Attendance Domain URLs.
"""
from django.urls import path
from daycare import views

urlpatterns = [
    path('daycare/scheduling/shifts/', views.StaffScheduleViewSet.as_view({'get': 'list', 'post': 'create'}), name='schedule_shifts_list'),
    path('daycare/scheduling/leaves/', views.LeaveRequestViewSet.as_view({'get': 'list', 'post': 'create'}), name='leave_request_list'),
    path('daycare/scheduling/swaps/', views.ShiftSwapRequestViewSet.as_view({'get': 'list', 'post': 'create'}), name='shift_swap_list'),
    path('daycare/holidays/', views.DaycareHolidayViewSet.as_view({'get': 'list', 'post': 'create'}), name='holiday_list'),
    path('daycare/attendance/', views.StudentAttendanceViewSet.as_view({'get': 'list', 'post': 'create'}), name='student_attendance_list'),
]
