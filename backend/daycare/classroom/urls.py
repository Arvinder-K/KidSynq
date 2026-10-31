"""
Classroom and Program Domain URLs.
"""
from django.urls import path
from daycare import views

urlpatterns = [
    path('dashboard/classrooms/', views.ClassroomDashboardStatsView.as_view(), name='dashboard_classrooms'),
    path('daycare/classrooms/', views.ClassroomViewSet.as_view({'get': 'list', 'post': 'create'}), name='classroom_list'),
    path('daycare/classrooms/<uuid:pk>/', views.ClassroomViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='classroom_detail'),
    path('daycare/programs/', views.ProgramListView.as_view(), name='program_list'),
    path('daycare/age-groups/', views.AgeGroupViewSet.as_view({'get': 'list', 'post': 'create'}), name='age_group_list'),
    path('daycare/branches/', views.BranchViewSet.as_view({'get': 'list', 'post': 'create'}), name='branch_list'),
]
