angular.module('proso.anatomy.controllers')

.controller('imageViewController', ['$scope', '$routeParams', 'contextService', 'imageService', 'flashcardService', 'colorScale', 'userService',
    function($scope, $routeParams, contextService, imageService, flashcardService, colorScale, userService) {
  'use strict';
  $scope.contextId = $scope.contextId || $routeParams.context;
  $scope.userService = userService;


  $scope.$watch('contextId', function() {
    if ($scope.contextId) {
      $scope.context = undefined;

      contextService.getContextByIdentifier($scope.contextId).then(function(data) {
        $scope.context = data;
        if ($scope.stats) {
          $scope.context.stats = $scope.stats;
        }
      });
    }
  });

  $scope.$watch('context', function() {
    if ($scope.context) {
      imageService.setImage($scope.context.content, function(ic) {
        var filter = {
          filter : [
              ['context/' + $scope.contextId],
          ],
          stats : true,
          user : $routeParams.user,
        };
        if ($scope.category) {
          filter.filter.push(['category/' + $scope.category.identifier]);
        }
        $scope.imageController = ic;
        $scope.context.flashcards = [];
        flashcardService.getFlashcards(filter).then(function(data) {
          $scope.context.flashcards = data;
          for (var i = 0; i < $scope.context.flashcards.length; i++) {
            var fc = $scope.context.flashcards[i];
            $scope.imageController.setColor(fc.description, colorScale(fc.prediction).hex());
          }
        });
      });
    }
  });
}]);

