from django.urls import path
from . import views

urlpatterns = [
    path('', views.ClassroomListView.as_view(), name='classrooms_list'),
    path('new/', views.ClassroomCreateEditView.as_view(), name='classrooms_create'),
    path('<uuid:pk>/', views.ClassroomDetailView.as_view(), name='classrooms_detail'),
    path('<uuid:pk>/edit/', views.ClassroomCreateEditView.as_view(), name='classrooms_edit'),
    path('programs/', views.ProgramsDashboardView.as_view(), name='classrooms_programs'),
    path('age-groups/', views.AgeGroupManagementView.as_view(), name='classrooms_age_groups'),
    path('ratio-monitoring/', views.RatioMonitoringView.as_view(), name='classrooms_ratio_monitoring'),
    path('ratio-rules/', views.DaycareRatioRulesView.as_view(), name='classrooms_ratio_rules'),
]

