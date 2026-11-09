from django import forms
from core.models import Student, StudentEmergencyContact, StudentPickup

class StudentForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = ['first_name', 'last_name', 'date_of_birth', 'gender', 'classroom', 'medical_info', 'dietary_restrictions']
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'date_of_birth': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'gender': forms.Select(attrs={'class': 'form-select'}),
            'classroom': forms.Select(attrs={'class': 'form-select'}),
            'medical_info': forms.Textarea(attrs={'rows': 2, 'class': 'form-control'}),
            'dietary_restrictions': forms.TextInput(attrs={'class': 'form-control'}),
        }

