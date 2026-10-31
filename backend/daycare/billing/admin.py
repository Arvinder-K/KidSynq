"""
Billing and Invoicing Domain Admin Configurations.
"""
from django.contrib import admin
from .models import Invoice, Payment, FeeStructure, TaxReceipt

for model in [Invoice, Payment, FeeStructure, TaxReceipt]:
    try:
        admin.site.register(model)
    except admin.sites.AlreadyRegistered:
        pass
