"""
Core views entrypoint.
"""
from .views_auth import (
    UserLoginView,
    UserLogoutView,
    DashboardRouterView,
    FamilyActivateView,
    FamilyForgotPasswordView,
    FamilyResetPasswordView,
)

__all__ = [
    'UserLoginView',
    'UserLogoutView',
    'DashboardRouterView',
    'FamilyActivateView',
    'FamilyForgotPasswordView',
    'FamilyResetPasswordView',
]

