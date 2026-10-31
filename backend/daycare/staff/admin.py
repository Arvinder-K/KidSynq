"""
Staff and Educator Domain Admin Configurations.
"""
from django.contrib import admin
from .models import Employee, ECECredential, CredentialType, Province

for model in [Employee, ECECredential, CredentialType, Province]:
    try:
        admin.site.register(model)
    except admin.sites.AlreadyRegistered:
        pass
