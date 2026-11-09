from django import forms
from core.models import Classroom, Program

class ClassroomForm(forms.ModelForm):
    class Meta:
        model = Classroom
        fields = ['room_name', 'capacity', 'program', 'description']
        widgets = {
            'room_name': forms.TextInput(attrs={'class': 'form-control'}),
            'capacity': forms.NumberInput(attrs={'class': 'form-control'}),
            'program': forms.Select(attrs={'class': 'form-select'}),
            'description': forms.Textarea(attrs={'rows': 2, 'class': 'form-control'}),
        }

