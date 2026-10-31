"""
Staff and Educator Domain URLs.
"""
from django.urls import path
from daycare import views

urlpatterns = [
    path('staff/', views.StaffListView.as_view(), name='staff_list'),
    path('daycare/employees/dashboard/', views.StaffDashboardView.as_view(), name='staff_dashboard'),
    path('daycare/employees/reports/', views.StaffReportsView.as_view(), name='staff_reports'),
    path('daycare/provinces/', views.ProvinceListView.as_view(), name='province_list'),
    path('daycare/credential-types/', views.CredentialTypeListView.as_view(), name='credential_type_list'),
    path('daycare/credentials/dashboard/', views.CredentialComplianceDashboardView.as_view(), name='credential_compliance_dashboard'),
    path('daycare/credentials/reports/', views.CredentialReportsView.as_view(), name='credential_reports'),
    path('daycare/credentials/send-alerts/', views.SendComplianceAlertsView.as_view(), name='credential_send_compliance_alerts'),
    path('daycare/credentials/expiring/', views.ECECredentialViewSet.as_view({'get': 'expiring'}), name='credential_expiring'),
    path('daycare/credentials/', views.ECECredentialViewSet.as_view({'get': 'list', 'post': 'create'}), name='credential_list'),
    path('daycare/credentials/<uuid:pk>/', views.ECECredentialViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='credential_detail'),
    path('daycare/employees/', views.EmployeeViewSet.as_view({'get': 'list', 'post': 'create'}), name='employee_list'),
    path('daycare/employees/<uuid:pk>/', views.EmployeeViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='employee_detail'),
]
