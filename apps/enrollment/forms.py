from django import forms
from core.models import RegistrationApplication, WaitlistEntry

class RegistrationApplicationForm(forms.ModelForm):
    class Meta:
        model = RegistrationApplication
        fields = [
            'child_first_name', 'child_last_name', 'child_date_of_birth',
            'parent_first_name', 'parent_last_name', 'parent_email', 'parent_phone',
            'requested_start_date', 'notes'
        ]
        widgets = {
            'child_first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'child_last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'child_date_of_birth': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'parent_first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'parent_last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'parent_email': forms.EmailInput(attrs={'class': 'form-control'}),
            'parent_phone': forms.TextInput(attrs={'class': 'form-control'}),
            'requested_start_date': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'notes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }

class WaitlistEntryForm(forms.ModelForm):
    class Meta:
        model = WaitlistEntry
        fields = [
            'child_first_name', 'child_last_name', 'child_dob',
            'applicant_name', 'applicant_email', 'applicant_phone',
            'requested_start_date', 'priority', 'status', 'notes'
        ]
        widgets = {
            'child_first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'child_last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'child_dob': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'applicant_name': forms.TextInput(attrs={'class': 'form-control'}),
            'applicant_email': forms.EmailInput(attrs={'class': 'form-control'}),
            'applicant_phone': forms.TextInput(attrs={'class': 'form-control'}),
            'requested_start_date': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'priority': forms.NumberInput(attrs={'class': 'form-control'}),
            'status': forms.TextInput(attrs={'class': 'form-control'}),
            'notes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }
