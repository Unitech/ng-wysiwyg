
/* global angular */

/**
 * @doc module
 * @id MoleskineModule
 * @description MoleskineModule
 *
 * @author Alexandre Strzelewicz <as@unitech.io>
 */

var MoleskineModule = angular.module('MoleskineModule', []);

/**
 * @doc directive
 * @id MoleskineModule:moleskine
 * 
 * @description Moleskine directive for AngularJS
 * @author Alexandre Strzelewicz <as@unitech.io>
 */
MoleskineModule.directive('moleskine', [function() {
  var moleskine = {
    restrict : 'E',
    replace  : true,
    scope    : { 
      bindData    : '=',
      width       : '@',
      height      : '@',
      input       : '@',
      output      : '@',
      defaultMode : '@',
      cssClass    : '@',
      autoGrow    : '@',
      enable      : '='
    },
    template : '<textarea></textarea>'
  };
  
  moleskine.controller = ['$scope', function($scope, el, attrs) {
  }];

  function launch(scope, el) {
    
    var editor = $(el).moleskine({
      width         : scope.width,
      height        : scope.height,
      baseContent   : angular.copy(scope.bindData),
      defaultMode   : scope.defaultMode,
      input         : scope.input,
      output        : scope.output,
      autoGrow      : scope.autoGrow,
      change        : function(err, content) {
        var phase = scope.$root.$$phase;

        if (content == '') return;
        scope.bindData = content;
        
        if (!(phase == '$apply' || phase == '$digest')) {
          scope.$apply();
        }
      }
    });
  }
  moleskine.link = function(scope, el, attrs, ngModel) {

    /**
     * When cascading WYSIWYG
     */

    if (scope.enable !== undefined) {
      scope.$watch('enable', function(aft, bef) {      
        if (aft == bef) return;
        launch(scope, el);
      });
    }
    else {
      var a = scope.$watch('bindData', function(aft, bef) {
        console.log(aft, bef);
        if (aft == bef && aft === undefined) return;
        // Delay one tick
        a();
        setTimeout(function() {
          launch(scope, el);
        }, 1);
      });
    }

    
  };

  return moleskine;
}]);


