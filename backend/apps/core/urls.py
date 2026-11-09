"""
Core URL patterns.
"""
from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.UserLoginView.as_view(), name='login'),
    path('logout/', views.UserLogoutView.as_view(), name='logout'),
    path('dashboard/', views.DashboardRouterView.as_view(), name='dashboard_router'),
]

