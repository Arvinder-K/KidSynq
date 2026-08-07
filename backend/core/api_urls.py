from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from . import api_views
from . import api_views_admin

urlpatterns = [
    # Auth
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Users
    path('users/me/', api_views.UserDetailView.as_view(), name='user_me'),
    
    # Dashboard
    path('dashboard/stats/', api_views.DashboardStatsView.as_view(), name='dashboard_stats'),
    path('dashboard/classrooms/', api_views.ClassroomDashboardStatsView.as_view(), name='dashboard_classrooms'),
    
    # Staff
    path('staff/', api_views.StaffListView.as_view(), name='staff_list'),
    
    # Students
    path('students/', api_views.StudentListView.as_view(), name='student_list'),
    
    # Teachers & Assignments
    path('teachers/available/', api_views.AvailableTeachersView.as_view(), name='available_teachers'),
    path('classroom-teachers/', api_views.ClassroomTeacherViewSet.as_view({'get': 'list', 'post': 'create'}), name='classroom_teacher_list'),
    path('classroom-teachers/<uuid:pk>/', api_views.ClassroomTeacherViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='classroom_teacher_detail'),
    path('classrooms/<uuid:pk>/teachers/', api_views.ClassroomTeachersView.as_view(), name='classroom_teachers_list'),
    
    # Age Groups
    path('age-groups/', api_views.AgeGroupViewSet.as_view({'get': 'list', 'post': 'create'}), name='age_group_list'),
    path('age-groups/<uuid:pk>/', api_views.AgeGroupViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='age_group_detail'),
    path('age-groups/<uuid:pk>/archive/', api_views.AgeGroupViewSet.as_view({'post': 'archive'}), name='age_group_archive'),
    path('age-groups/<uuid:pk>/restore/', api_views.AgeGroupViewSet.as_view({'post': 'restore'}), name='age_group_restore'),
    
    # Programs & Classrooms
    path('programs/', api_views.ProgramListView.as_view(), name='program_list'),
    path('classrooms/', api_views.ClassroomListView.as_view(), name='classroom_list'),
    path('classrooms/<uuid:pk>/assign-teacher/', api_views.ClassroomAssignTeacherView.as_view(), name='classroom_assign_teacher'),
    path('classrooms/<uuid:pk>/assign-student/', api_views.ClassroomAssignStudentView.as_view(), name='classroom_assign_student'),
    
    # Attendance
    path('attendance/', api_views.AttendanceListView.as_view(), name='attendance_list'),
    
    # Activities
    path('activities/report/', api_views.DailyReportView.as_view(), name='daily_report'),
    path('activities/log/', api_views.ActivityLogView.as_view(), name='activity_log'),
    
    # Health & Medical
    path('health/dashboard/', api_views.HealthDashboardView.as_view(), name='health_dashboard'),
    path('health/student/<uuid:pk>/', api_views.StudentHealthDetailView.as_view(), name='health_student_detail'),
    path('health/medication/log/', api_views.MedicationAdministrationView.as_view(), name='health_medication_log'),
    
    # Billing & Subscriptions
    path('billing/invoices/', api_views.InvoiceListView.as_view(), name='invoice_list'),
    path('billing/invoices/<uuid:pk>/', api_views.InvoiceDetailView.as_view(), name='invoice_detail'),
    path('billing/subscriptions/', api_views.SubscriptionPlanListView.as_view(), name='subscription_plan_list'),
    path('billing/subscriptions/checkout/', api_views.SubscriptionCheckoutView.as_view(), name='subscription_checkout'),
    
    # Communication
    path('communication/announcements/', api_views.AnnouncementListView.as_view(), name='announcement_list'),
    
    # Profile
    path('profile/', api_views.UserProfileView.as_view(), name='profile_detail'),
    path('profile/password/', api_views.UserPasswordView.as_view(), name='profile_password'),
    
    # Documents
    path('documents/folders/', api_views.DocumentFolderView.as_view(), name='document_folders'),
    path('documents/', api_views.DocumentListView.as_view(), name='document_list'),
    
    # Compliance
    path('compliance/incidents/', api_views.IncidentListView.as_view(), name='incident_list'),
    path('compliance/inspections/', api_views.InspectionListView.as_view(), name='inspection_list'),
    
    # Super Admin Platform
    path('admin/daycares/', api_views_admin.AdminDaycareListView.as_view(), name='admin_daycare_list'),
    path('admin/daycares/<uuid:pk>/', api_views_admin.AdminDaycareDetailView.as_view(), name='admin_daycare_detail'),
    path('admin/users/', api_views_admin.AdminUserListView.as_view(), name='admin_user_list'),
    path('admin/users/<uuid:pk>/', api_views_admin.AdminUserDetailView.as_view(), name='admin_user_detail'),
    path('admin/subscriptions/plans/', api_views_admin.AdminSubscriptionPlanListView.as_view(), name='admin_plan_list'),
    path('admin/subscriptions/plans/<uuid:pk>/', api_views_admin.AdminSubscriptionPlanDetailView.as_view(), name='admin_plan_detail'),
    path('admin/subscriptions/assigned/', api_views_admin.AdminDaycareSubscriptionListView.as_view(), name='admin_assigned_subscriptions'),
]
