from django.urls import path
from . import views_ui

urlpatterns = [
    path('dashboard/', views_ui.FamilyDashboardView.as_view(), name='family_dashboard'),
    path('children/', views_ui.FamilyChildrenView.as_view(), name='family_children'),
    path('profile/', views_ui.FamilyProfileView.as_view(), name='family_profile'),
    path('guardians/', views_ui.FamilyGuardiansView.as_view(), name='family_guardians'),
    path('daily-reports/', views_ui.FamilyDailyReportsView.as_view(), name='family_daily_reports'),
    path('attendance/', views_ui.FamilyAttendanceView.as_view(), name='family_attendance'),
    path('billing/', views_ui.FamilyBillingView.as_view(), name='family_billing'),
    path('documents/', views_ui.FamilyDocumentsView.as_view(), name='family_documents'),
    path('consents/', views_ui.FamilyConsentsView.as_view(), name='family_consents'),
]

