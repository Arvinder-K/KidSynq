"""
Reports and Analytics Domain Admin Configurations.
"""
from django.contrib import admin
from .models import DailyReport, RatioRule, IncidentReport

for model in [DailyReport, RatioRule, IncidentReport]:
    try:
        admin.site.register(model)
    except admin.sites.AlreadyRegistered:
        pass
