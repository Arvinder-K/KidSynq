from rest_framework import viewsets, status, serializers
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from core.models import Branch, DaycareSubscription
from core.limits import check_subscription_limit
from core.permissions import IsDaycareAdmin


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = '__all__'
        read_only_fields = ['id', 'daycare', 'created_at', 'updated_at', 'deleted_at']


class BranchViewSet(viewsets.ModelViewSet):
    serializer_class = BranchSerializer
    permission_classes = [IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        return Branch.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('-created_at')

    def perform_create(self, serializer):
        daycare = self.request.user.daycare
        
        is_allowed, error_code, error_msg = check_subscription_limit(daycare, 'branches')
        if not is_allowed:
            raise PermissionDenied(detail=error_msg)
            
        serializer.save(daycare=daycare)

    def perform_destroy(self, instance):
        # Soft delete
        instance.deleted_at = timezone.now()
        instance.status = 'Deleted'
        instance.save()

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        daycare = self.request.user.daycare
        try:
            # Need to get even deleted objects
            instance = Branch.objects.get(pk=pk, daycare=daycare)
            
            # Check limit before restoring
            is_allowed, error_code, error_msg = check_subscription_limit(daycare, 'branches')
            if not is_allowed:
                raise PermissionDenied(detail=error_msg)
                
            instance.deleted_at = None
            instance.status = 'Active'
            instance.save()
            return Response({'status': 'restored'})
        except Branch.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def check_limit(self, request):
        daycare = self.request.user.daycare
        active_sub = DaycareSubscription.objects.filter(
            daycare=daycare, 
            subscription_status__in=['active', 'trial']
        ).first()
        
        max_branches = 0
        if active_sub and active_sub.subscription_plan:
            max_branches = active_sub.subscription_plan.max_branches
            
        current_count = Branch.objects.filter(daycare=daycare, deleted_at__isnull=True).count()
        
        return Response({
            'current_count': current_count,
            'max_branches': max_branches,
            'is_allowed': max_branches == -1 or (max_branches > 0 and current_count < max_branches),
            'is_enabled': max_branches != 0
        })
