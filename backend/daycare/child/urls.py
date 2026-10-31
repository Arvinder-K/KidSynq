"""
Child and Student Domain URLs.
"""
from django.urls import path
from daycare import views

urlpatterns = [
    path('daycare/students/', views.StudentViewSet.as_view({'get': 'list', 'post': 'create'}), name='student_list'),
    path('daycare/students/<uuid:pk>/', views.StudentViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='student_detail'),
    path('daycare/health/dashboard/', views.HealthDashboardView.as_view(), name='health_dashboard'),
    path('daycare/health/students/<uuid:student_id>/', views.StudentHealthDetailView.as_view(), name='student_health_detail'),
    path('daycare/health/medications/administer/', views.MedicationAdministrationView.as_view(), name='medication_administer'),
    path('daycare/safe-arrival/events/', views.SafeArrivalEventViewSet.as_view({'get': 'list', 'post': 'create'}), name='safe_arrival_events'),
]
