from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.FamilyDashboardView.as_view(), name='family_dashboard'),
    path('children/', views.FamilyChildrenView.as_view(), name='family_children'),
    path('profile/', views.FamilyProfileView.as_view(), name='family_profile'),
    path('guardians/', views.FamilyGuardiansView.as_view(), name='family_guardians'),
    path('daily-reports/', views.FamilyDailyReportsView.as_view(), name='family_daily_reports'),
    path('attendance/', views.FamilyAttendanceView.as_view(), name='family_attendance'),
    path('billing/', views.FamilyBillingView.as_view(), name='family_billing'),
    path('documents/', views.FamilyDocumentsView.as_view(), name='family_documents'),
    path('consents/', views.FamilyConsentsView.as_view(), name='family_consents'),
]

