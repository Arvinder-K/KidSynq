"""
URL configuration for kidsynq project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView

from core import views_auth
from daycare import views_ui as daycare_views_ui

urlpatterns = [
    # Core Authentication & Routing
    path('', views_auth.DashboardRouterView.as_view(), name='home'),
    path('login/', views_auth.UserLoginView.as_view(), name='login'),
    path('logout/', views_auth.UserLogoutView.as_view(), name='logout'),
    path('dashboard/', views_auth.DashboardRouterView.as_view(), name='dashboard_router'),

    # Family Auth
    path('family/activate/<str:token>/', views_auth.FamilyActivateView.as_view(), name='family_activate_token'),
    path('family/activate/', views_auth.FamilyActivateView.as_view(), name='family_activate'),
    path('family/forgot-password/', views_auth.FamilyForgotPasswordView.as_view(), name='family_forgot_password'),
    path('family/reset-password/<str:token>/', views_auth.FamilyResetPasswordView.as_view(), name='family_reset_password_token'),
    path('family/reset-password/', views_auth.FamilyResetPasswordView.as_view(), name='family_reset_password'),

    # Public Parent Registration
    path('register/<str:daycare_slug>/', daycare_views_ui.RegistrationLandingView.as_view(), name='registration_landing'),
    path('register/<str:daycare_slug>/apply/', daycare_views_ui.RegistrationWizardView.as_view(), name='registration_wizard'),

    # Application UI Modules (Django MTV)
    path('superadmin/', include('superadmin.urls_ui')),
    path('daycare/', include('daycare.urls_ui')),
    path('family/', include('daycare.urls_family')),

    # Django Admin Site
    path('django-admin/', RedirectView.as_view(url='/admin/', permanent=False)),
    path('admin/', admin.site.urls),

    # Preserved REST Framework APIs (for external integrations & dynamic feeds)
    path('api/super-admin/', include('superadmin.urls')),
    path('api/', include('daycare.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
