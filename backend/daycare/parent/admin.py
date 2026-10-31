"""
Parent and Family Domain Admin Configurations.
"""
from django.contrib import admin
from .models import Family, Guardian, ConsentForm

for model in [Family, Guardian, ConsentForm]:
    try:
        admin.site.register(model)
    except admin.sites.AlreadyRegistered:
        pass
