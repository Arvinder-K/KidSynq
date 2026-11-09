from django.urls import path
from .views import PaymentsReceiptsView

urlpatterns = [
    path('receipts/', PaymentsReceiptsView.as_view(), name='payments_receipts'),
]

