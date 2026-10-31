"""
Child and Student Domain Admin Configurations.
"""
from django.contrib import admin
from .models import Student, HealthProfile, SafeArrivalDepartureEvent

for model in [Student, HealthProfile, SafeArrivalDepartureEvent]:
    try:
        admin.site.register(model)
    except admin.sites.AlreadyRegistered:
        pass
