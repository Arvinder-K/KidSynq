"""
Classroom and Program Domain Admin Configurations.
"""
from django.contrib import admin
from .models import Classroom, Program, AgeGroup, Branch

for model in [Classroom, Program, AgeGroup, Branch]:
    try:
        admin.site.register(model)
    except admin.sites.AlreadyRegistered:
        pass
