"""
Core application forms.
"""
from django import forms
from django.contrib.auth import get_user_model

User = get_user_model()

class LoginForm(forms.Form):
    username = forms.CharField(max_length=254, required=True, widget=forms.TextInput(attrs={'class': 'form-control'}))
    password = forms.CharField(required=True, widget=forms.PasswordInput(attrs={'class': 'form-control'}))
    login_type = forms.CharField(max_length=50, required=False, initial='daycare')

class UserProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'mobile']
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'mobile': forms.TextInput(attrs={'class': 'form-control'}),
        }

