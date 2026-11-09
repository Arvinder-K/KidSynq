from django import forms
from core.models import Announcement, ConsentForm

class AnnouncementForm(forms.ModelForm):
    class Meta:
        model = Announcement
        fields = ['title', 'content', 'type', 'status']
        widgets = {
            'title': forms.TextInput(attrs={'class': 'form-control'}),
            'content': forms.Textarea(attrs={'class': 'form-control', 'rows': 4}),
            'type': forms.TextInput(attrs={'class': 'form-control'}),
            'status': forms.Select(attrs={'class': 'form-select'}, choices=[('Published', 'Published'), ('Draft', 'Draft')]),
        }

class ConsentFormCreateForm(forms.ModelForm):
    class Meta:
        model = ConsentForm
        fields = ['title', 'description', 'content', 'form_type', 'requires_signature']
        widgets = {
            'title': forms.TextInput(attrs={'class': 'form-control'}),
            'description': forms.TextInput(attrs={'class': 'form-control'}),
            'content': forms.Textarea(attrs={'class': 'form-control', 'rows': 5}),
            'form_type': forms.TextInput(attrs={'class': 'form-control'}),
            'requires_signature': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
