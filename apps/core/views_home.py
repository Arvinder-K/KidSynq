"""
Public Business Homepage View for KidSynq SaaS.
Replaces the raw login redirect on '/' with a high-converting, modern B2B SaaS
business landing page matching the CheckOnIt dark glassmorphic aesthetic with
daycare background imagery.
"""
from django.shortcuts import render
from django.views import View
from core.models import Daycare, Student, Classroom, Employee


class HomeBusinessPageView(View):
    """
    Renders the public KidSynq business landing page.
    """
    def get(self, request, *args, **kwargs):
        daycares = Daycare.objects.all().order_by('name')[:6]
        total_daycares = Daycare.objects.count()
        total_students = Student.objects.filter(status='Active').count()
        total_classrooms = Classroom.objects.count()
        total_educators = Employee.objects.count()

        context = {
            'daycares': daycares,
            'total_daycares': total_daycares or 12,
            'total_students': total_students or 150,
            'total_classrooms': total_classrooms or 24,
            'total_educators': total_educators or 45,
            'user_is_authenticated': request.user.is_authenticated,
        }
        return render(request, 'public/home_business.html', context)
