"""AI Insights views for Phase 8 Smart Campus OS."""
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from core.ai_insights import CampusAIService
from core.permissions import IsAdmin

class CampusInsightsViewSet(viewsets.ViewSet):
    """
    Predictive analytics dashboard for high-level management.
    (Principal, Director, Admin)
    """
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    @action(detail=False, methods=['get'])
    def overview(self, request):
        """Unified AI portal showing hotspots and general health."""
        college_id = request.user.college_id
        if not college_id:
            return Response({'error': 'No college context'}, status=400)
            
        hotspots = CampusAIService.get_block_health_metrics(college_id)
        
        return Response({
            'hotspots': hotspots,
            'summary': {
                'total_alerts': len(hotspots),
                'risk_level': 'medium' if len(hotspots) > 2 else 'low'
            }
        })

    @action(detail=True, methods=['get'], url_path='student-risk')
    def student_risk(self, request, pk=None):
        """Get predictive risk score for a specific student."""
        score = CampusAIService.calculate_student_risk_score(pk)
        
        return Response({
            'student_id': pk,
            'risk_score': score,
            'confidence': 0.85, # Static for now
            'status': 'high_risk' if score > 70 else 'monitored' if score > 30 else 'low_risk'
        })

    @action(detail=False, methods=['get'])
    def meal_forecast(self, request):
        """AI-driven meal wastage prediction."""
        meal_type = request.query_params.get('meal_type', 'lunch')
        prediction = CampusAIService.predict_meal_wastage(request.user.college_id, meal_type)
        
        return Response({
            'meal_type': meal_type,
            'predicted_waste_kg': round(prediction, 2),
            'smart_suggestion': "Reduce quantity by 10% based on historical Monday patterns."
        })
