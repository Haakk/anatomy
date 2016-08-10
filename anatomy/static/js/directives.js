/* Directives */
angular.module('proso.anatomy.directives', ['proso.anatomy.templates'])

  .directive('termLabel', ['colorScale', 'gettextCatalog', function(colorScale, gettextCatalog) {
    return {
      restrict : 'A',
      template : '{{flashcard.term.name}}',
      link : function($scope, elem) {
        elem.addClass('label');
        elem.addClass('label-default');
        elem.css('border-bottom', '5px solid ' + colorScale(Math.ceil(10 * $scope.flashcard.prediction) / 10).hex());
        if ($scope.flashcard.practiced) {
          elem.css('border-left', '5px solid #fe3');
        }
        if ($scope.flashcard.mastered) {
          elem.css('border-left', '5px solid #5ca03c');
        }
        var alternativeNames = $scope.flashcard.term.name.split(';').splice(1).join('<br>');
        elem.tooltip({
          html : true,
          placement: 'bottom',
          container: 'body',
          title : ($scope.flashcard.term_secondary && $scope.flashcard.context ? 
               '<div>' +
                 $scope.flashcard.context.name + ': ' +
                 '<strong>' + $scope.flashcard.term_secondary.name + '</strong>' +
               '</div><br>':
               '') +
                '<div class="skill-tooltip">' +
                gettextCatalog.getString('Odhad znalosti') +
                ' <span class="badge badge-default">' +
                  '<i class="color-indicator" style="background-color :' +
                  colorScale(Math.ceil(10 * $scope.flashcard.prediction) / 10).hex() + '"></i>' +
                  (Math.ceil(10 * $scope.flashcard.prediction)) + ' / 10 ' +
                '</span>' +
               '</div>' +
               (alternativeNames ? 
               '<div>' +
                gettextCatalog.getString('Alternativní názvy') +
                ':<br> <strong>' + alternativeNames + '</strong>' +
               '</div>':
               ''),
        });
      }
    };
  }])

.directive('anatomyImage', [
    'imageService', '$window', '$', 'colorService', '$timeout', '$filter', 'colors',
    function(imageService, $window, $, colorService, $timeout, $filter, colors) {
  var ANIMATION_TIME_MS = 1000;

  return {
      restrict: 'A',
      scope: {
          dset: '='
      },
      template: '<div class="alert alert-info" ng-if="alert">{{alert}}</div>',
      link: function(scope, element, attrs) {
          element.parent().addClass('anatomy-image');

          function setMinImageHeight() {
            angular.element('#ng-view').removeClass('horizontal');
            var screenAspectRatio = $window.innerHeight / $window.innerWidth;

            if (screenAspectRatio < 1 && $window.innerWidth > 600) {
              angular.element('#ng-view').addClass('horizontal');
              element.css("min-height", $window.innerHeight);
            } else {
              element.css("min-height", $window.innerHeight / 2);
            }
          }
          setMinImageHeight();
          angular.element(window).bind('resize', function() {
            setMinImageHeight();
          });

          var initImage = function(image){
            var paper = {
              x : 0,
              y : 0,
            };
            element.attr("oncontextmenu", "return false;");
            element[0].innerHTML = "";
            var r = Raphael(element[0]);
            var clickFn;


            function clickHandler(){
              var clickedCode = this.data('code');
              if (!clickedCode || scope.$parent.canNext) {
                return;
              }
              if (clickFn) clickFn(clickedCode);
              scope.$parent.$apply();
            }

            var paths = [];
            var pathsObj = {};
            var pathsByCode = {};
            var rPathsObj = {};

            var highlights = [];
            var highlightsByCode = {};

            var that = {
              onClick: function(callback) {
                clickFn = callback;
              },
              highlightItem : function(code, color, animate) {
                var paths = code ? (pathsByCode[code] || []) : [];
                var bbox = getBBox(paths.map(function(p) {return p.getBBox();}));
                angular.forEach(paths, function(path) {
                  if (color == 'no-change') {
                    color = chroma(path.data('color')).darken().hex();
                  }
                  if (color) {
                    path.attr({
                      'fill' : animate ? '#fff' : path.data('color'),
                      'stroke' : animate ? '#fff' : path.data('stroke-color'),
                    });
                    var animAttrs = {
                      'fill' : color,
                      'stroke' : color,
                      'opacity' : 1,
                    };
                    path.animate(animAttrs, ANIMATION_TIME_MS, '>');
                    path.data('highlight-color', color);
                    highlights.push(path);
                  }
                });

                if (animate) {
                  var highlightEllipse = r.circle(
                    bbox.x + bbox.width / 2,
                    bbox.y + bbox.height / 2,
                    Math.max(bbox.width, bbox.height) / 2);
                  highlightEllipse.attr({
                    'stroke-width' : image.bbox.height / 100,
                    'stroke' : color,
                    'stroke-opacity' : 0.5,
                    'transform' : 's ' + getZoomRatio(bbox),
                  });
                  var animAttrs = {
                    transform : '',
                  };
                  highlightEllipse.animate(animAttrs, ANIMATION_TIME_MS / 2, '>', function() {
                    highlightEllipse.remove();
                  });
                }
              },

              clearHighlights : function() {
                for (var i = 0; i < highlights.length; i++) {
                  highlights[i].attr({
                    'fill' : highlights[i].data('color'),
                    'stroke' : highlights[i].data('stroke-color'),
                    'opacity' : highlights[i].data('opacity'),
                  });
                  highlights[i].data('highlight-color', undefined);
                }
                highlights = [];
                highlightsByCode = {};
              },
              setColor : function(code, color) {
                var paths = pathsByCode[code] || [];
                for (var i = 0; i < paths.length; i++) {
                  paths[i].data('color', color);
                  paths[i].data('stroke-color', color);
                  paths[i].attr({
                    'fill' : color,
                    'stroke' : color,
                  });
                }
              },
              hoverIn : hoverInHandler,
              hoverOut : hoverOutHandler,
              highlightAnswer : function (question, selected) {
                  var asked = question.description;
                  if ($filter('isFindOnMapType')(question)) {
                      that.highlightItem(asked, colors.GOOD);
                  }
                  that.highlightItem(selected, asked == selected ? colors.GOOD : colors.BAD);
              },
              highlightQuestion : function (question) {
                if ($filter('isPickNameOfType')(question)) {
                  var callback = function(iteration) {
                    that.highlightItem(
                      question.description, colors.HIGHLIGHTS[1], true);
                    $timeout(function() {
                      if (!question.responseTime) {
                        callback(iteration + 1);
                      }   
                    }, 2 * ANIMATION_TIME_MS * iteration * iteration);
                  };  
                  callback(1);
                }
                if ($filter('isFindOnMapType')(question) && question.options) {
                  for (var i = 0; i < question.options.length; i++) {
                    question.options[i].bgcolor = colors.HIGHLIGHTS[i];
                    question.options[i].color = colors.HIGHLIGHTS_CONTRAST[i];
                    that.highlightItem(
                      question.options[i].description,
                      colors.HIGHLIGHTS[i]);
                  }
                }
              },

            };

            function hoverInHandler(pathCode) {
              var path = pathsByCode[pathCode] && pathsByCode[pathCode][0] || this;
              setHoverColor(path, true);
            }

            function hoverOutHandler(pathCode) {
              var path = pathsByCode[pathCode] && pathsByCode[pathCode][0] || this;
              setHoverColor(path, false);
            }

            function getZoomRatio(bbox) {
              var widthRatio =  image.bbox.width / bbox.width;
              var heightRatio = image.bbox.height / bbox.height;
              var minRatio = Math.min(widthRatio, heightRatio);
              var zoomRatio = Math.max(1.05, minRatio);
              return zoomRatio;
            }
            
            function canBeSelected(code) {
              return $filter('isFindOnMapType')(scope.$parent.question) &&
                !scope.$parent.canNext &&
                $filter('isAllowedOption')(scope.$parent.question, code);
            }

            function setHoverColor(path, lower) {
                var code = path && path.data && path.data('code');
                if (code && (!attrs.practice || canBeSelected(code))) {
                  var paths = (pathsByCode[code] || []).concat(
                      highlightsByCode[code] || []);
                  for (var i = 0; i < paths.length; i++) {
                    var attr = getHoverAttr(paths[i], lower);
                    paths[i].attr(attr);
                  }
                }
            }

            function getHoverAttr(path, lower) {
              var attr;
              var color = path.data('highlight-color') || path.data('color');
              var strokeColor = path.data('highlight-color') || path.data('stroke-color');
              if (lower) {
                attr = {
                  'fill' : chroma(color).darken().hex(),
                  'stroke' : strokeColor && chroma(strokeColor).darken().hex(),
                  'cursor' : 'pointer',
                };
              } else {
                attr = {
                  'fill' : color,
                  'stroke' : strokeColor,
                  'cursor' : 'default',
                };
              }
              return attr;
            }

            function getBBox(bboxes) {
              var xs = bboxes.map(function(b){return b.x;});
              var minX = Math.min.apply(Math, xs);
              var ys = bboxes.map(function(b){return b.y;});
              var minY = Math.min.apply(Math, ys);
              var x2s = bboxes.map(function(b){return b.x2;});
              var maxX = Math.max.apply(Math, x2s);
              var y2s = bboxes.map(function(b){return b.y2;});
              var maxY = Math.max.apply(Math, y2s);
              return {
                x : minX,
                y : minY,
                width : maxX - minX,
                height : maxY - minY,
              };
            }


            for (var i = 0; i < image.paths.length; i++) {
              var p = image.paths[i];
              var simplePathString = p.d;
              var path = r.path(simplePathString);
              var color = colorService.toGrayScale(p.color);
              var strokeColor = p.stroke && colorService.toGrayScale(p.stroke);
              path.attr({
                'fill' : color,
                'opacity' : p.opacity,
                'stroke-width' : p.stroke_width,
                'stroke' : strokeColor,
              });
              path.data('id', p.id);
              path.data('color', color);
              path.data('stroke-color', strokeColor);
              path.data('opacity', p.opacity);
              path.click(clickHandler);
              path.hover(hoverInHandler, hoverOutHandler);
              p.bbox = p.bbox || path.getBBox();
              paths.push(path);
              rPathsObj[p.id] = path;
              var code = p.term;
              path.data('code', code);
              if (!pathsByCode[code]) {
                pathsByCode[code] = [];
              }
              pathsByCode[code].push(path);
              pathsObj[p.id] = p;
            }

            image.bbox = image.bbox || getBBox(image.paths.map(function(p) {
              p.bbox.x2 = p.bbox.x + p.bbox.width;
              p.bbox.y2 = p.bbox.y + p.bbox.height;
              return p.bbox;
            }));

            function setTermsConteinerHeight(screenAspectRatio) {
              if (!attrs.practice) {
                var height;
                if (screenAspectRatio < 1) {
                  height = $window.innerHeight * 0.7 + 40;
                } else {
                  height = ($window.innerHeight / 2) - 40;
                }
                angular.element('.terms-container').css('max-height', height + 'px');
              }
            }

            function getHorizontalViewDimensions(paper){
              var imageOfWindowWidthRatio = 0.7;
              if (attrs.practice) {
                var headerHeight = angular.element('.header-practice').height() || 0;
                headerHeight += angular.element('#nav-main').height() || 0;
                headerHeight -= Math.min(60, angular.element($window).scrollTop());
                var alertHeight = angular.element('.beta-alert').outerHeight() ||
                  angular.element('.bottom-alert').outerHeight() || 0;
                paper.height = $window.innerHeight - (25 + headerHeight + alertHeight);
                paper.width = $window.innerWidth  * 0.7 - 20;
              } else {
                if ($window.innerWidth > 992) {
                  imageOfWindowWidthRatio *= 10 / 12;
                }
                paper.height = $window.innerHeight * 0.7 - 20;
                paper.width = $window.innerWidth * imageOfWindowWidthRatio - 40;
              }
              return paper;
            }

            function onWidowResize(){
              angular.element('#ng-view').removeClass('horizontal');
              var screenAspectRatio = $window.innerHeight / $window.innerWidth;

              if (screenAspectRatio < 1 && $window.innerWidth > 600) {
                angular.element('#ng-view').addClass('horizontal');
                paper = getHorizontalViewDimensions(paper);
              } else {
                paper.height = ($window.innerHeight / 2) * (attrs.relativeHeight || 1);
                paper.width = $window.innerWidth - 35;
              }
              setTermsConteinerHeight(screenAspectRatio);

              r.setSize(paper.width, paper.height);
              r.setViewBox(image.bbox.x, image.bbox.y, image.bbox.width, image.bbox.height, true);
            }
            onWidowResize();
            angular.element($window).bind('resize', function() {
              onWidowResize();
            });
            if (attrs.practice) {
              angular.element("html, body").animate({
                scrollTop: (angular.element('.navbar').height() - 8) + "px"
              }, function() {
                onWidowResize();
              });
            }

            return that;
          };

          attrs.$observe('code', function(value) {
            if (value) {
              imageService.getImage(function(i) {
                if (typeof i == 'string') {
                  scope.alert = i;
                } else {
                  return initImage(i);
                }
              });
            }
          });
          
      }
  };
}])

  .directive('blindMap', ['mapControler', 'places', 'singleWindowResizeFn',
        'getMapResizeFunction', '$parse',
      function(mapControler, places, singleWindowResizeFn,
        getMapResizeFunction, $parse) {
    return {
      restrict : 'E',
      templateUrl : 'static/tpl/map_tpl.html',
      link : function($scope, elem, attrs) {
        $scope.loading = true;
        $scope.name = places.getName($scope.part);
        $scope.practice = !attrs.showTooltips;
        var showTooltips = attrs.showTooltips !== undefined;

        var map = mapControler($scope.part, showTooltips, elem, function(m) {
          $scope.loading = false;
          var resize = getMapResizeFunction(m, elem, $scope.practice);
          singleWindowResizeFn(resize);
          resize();
          $scope.$eval(attrs.callback);
          $scope.$digest();
        });
        var model = $parse(attrs.map);
        //Set scope variable for the map
        model.assign($scope, map);
      },
      replace : true
    };
  }])

  .directive('email', function() {
    return {
      restrict : 'C',
      compile : function(elem) {
        var emailAddress = elem.html();
        emailAddress = emailAddress.replace('{zavinac}', '@');
        emailAddress = '<a href="mailto:' + emailAddress +
  '">' + emailAddress +
  '</a>';
        elem.html(emailAddress);
      }
    };
  })

  .directive('atooltip', function() {
    return {
      restrict : 'C',
      link : function($scope, elem, attrs) {
        elem.tooltip({
          'placement' : attrs.placement || 'bottom',
          'container' : attrs.container,
        });
      }
    };
  })

  .directive('points', ['$timeout', 'events', function($timeout, events) {
    return {
      scope : true,
      restrict : 'C',
      link : function($scope, elem) {
        events.on('userUpdated', function(user) {
          $scope.user = user;
          if (user.points == 1) {
            $timeout(function() {
              elem.tooltip('show');
            }, 0);
          }
        });
      }
    };
  }])

  .directive('categoryProgress', [function() {
    return {
      restrict : 'A',
      templateUrl : 'static/tpl/progress_tpl.html',
      link : function($scope, elem, attrs) {
        $scope.skills = undefined;
        attrs.$observe('skills', function(skills) {
          if(skills !== '') {
            $scope.skills = angular.fromJson(skills);
            $scope.skills.number_of_nonmastered_practiced_items =
              Math.max(0, $scope.skills.number_of_practiced_items -
              ($scope.skills.number_of_mastered_items || 0));
          }
        });
        attrs.$observe('hideLabels', function(hideLabels) {
          $scope.hideLabels = hideLabels;
        });
      }
    };
  }])

  .directive('categoryProgressLabels', [function() {
    return {
      restrict : 'A',
      templateUrl : 'static/tpl/progress_labels_tpl.html',
      link : function($scope, elem, attrs) {
        $scope.skills = undefined;
        attrs.$observe('skills', function(skills) {
          if(skills !== '') {
            $scope.skills = angular.fromJson(skills);
            $scope.skills.number_of_nonmastered_practiced_items =
              Math.max(0, $scope.skills.number_of_practiced_items -
              ($scope.skills.number_of_mastered_items || 0));
          }
        });
        attrs.$observe('hideLabels', function(hideLabels) {
          $scope.hideLabels = hideLabels;
        });
      }
    };
  }])

  .directive('levelProgressBar',['userService', '$timeout', 'gettextCatalog',
      function(userService, $timeout, gettextCatalog) {

    function getLevelInfo(user) {
      var points = user.number_of_correct_answers || 0;
      var levelEnd = 0;
      var levelRange = 30;
      var rangeIncrease = 0;
      for (var i = 1; true; i++) {
        levelEnd += levelRange;
        if ((points || 0) < levelEnd) {
          return {
            level : i,
            form : levelEnd - levelRange,
            to : levelEnd,
            range : levelRange,
            points : points - (levelEnd - levelRange),
          };
        }
        levelRange += rangeIncrease;
        rangeIncrease += 10;
      }

    }
    return {
      restrict : 'C',
      template : '<span class="badge level-start" ' +
                   'tooltip-append-to-body="true" ' +
                   'ng-bind="level.level" tooltip="' + gettextCatalog.getString('Aktuální úroveň') + '">' +
                 '</span>' +
                 '<div class="progress level-progress" ' +
                     'tooltip-append-to-body="true" ' +
                     'tooltip="{{level.points}} / {{level.range}} ' +
                     gettextCatalog.getString('bodů do příští úrovně') + '">' +
                   '<div class="progress-bar progress-bar-warning" ' +
                        'style="width: {{(level.points/level.range)|percent}};">' +
                   '</div>' +
                 '</div>' +
                 '<span class="badge level-goal" ' +
                     'tooltip-append-to-body="true" ' +
                     'ng-bind="level.level+1" tooltip="' + gettextCatalog.getString('Příští úroveň') + '">' +
                 '</span>',
      link : function($scope, elem, attrs) {
        elem.addClass('level-wrapper');
        if (attrs.username != userService.user.username) {
          userService.getUserProfile(attrs.username, true).success(function(data){
            $scope.level = getLevelInfo(data);
          });
        } else {
          $scope.level = getLevelInfo(userService.user.profile);
        }
      }
    };
  }])

  .directive('myGooglePlus', ['$window', function ($window) {
    return {
      restrict: 'A',
      link: function (scope, element) {
        element.addClass('g-plus');
        scope.$watch(function () { return !!$window.gapi; },
          function (gapiIsReady) {
            if (gapiIsReady) {
              $window.gapi.plus.go(element.parent()[0]);
            }
          });
      }
    };
  }])

  .directive('myFbShare', ['$window', function ($window) {
    return {
      restrict: 'A',
      link: function (scope, element) {
        element.addClass('fb-share-button');
        scope.$watch(function () { return !!$window.FB; },
          function (fbIsReady) {
            if (fbIsReady) {
              $window.FB.XFBML.parse(element.parent()[0]);
            }
          });
      }
    };
  }])

  .directive('locationAppend', ['$rootScope', '$location',
      function ($rootScope, $location) {
    return {
      restrict: 'A',
      link: function ($scope, element, attrs) {
        var url = attrs.href.substring(0, 3);
        $rootScope.$on("$routeChangeSuccess", function() {
          element.attr('href', url + $location.path());
        });
      }
    };
  }])

  .directive('trackClick', ['$analytics', function ($analytics) {
    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        element.bind("click", function(){
          $analytics.eventTrack('click', {
            category: attrs.trackClick,
            label: attrs.href,
          });
        });
      }
    };
  }])

  .directive('trackHover', ['$analytics', function ($analytics) {
    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        element.bind("mouseover", function(){
          $analytics.eventTrack('hover', {
            category: attrs.trackHover,
          });
        });
      }
    };
  }])

  .directive('dynamicTitle', ['$rootScope', 'pageTitle', '$route', '$timeout',
      function ($rootScope, pageTitle, $route, $timeout) {
    return {
      restrict : 'A',
      scope : {},
      link : function (scope, element, attrs) {
        $rootScope.$on("$locationChangeSuccess", function() {
          $rootScope.title = pageTitle($route.current) + attrs.dynamicTitle;
          //console.log($rootScope.title);
          $timeout(function() {
            element.text($rootScope.title);
            //console.log($rootScope.title);
          }, 0, false);
        });
      }
    };
  }])

  .directive('setPlaceTypeNames', ['places', function (places) {
    return {
      restrict : 'A',
      link : function (scope, element, attrs) {
        var obj = angular.fromJson(attrs.setPlaceTypeNames);
        places.setPlaceTypeNames(obj);
      }
    };
  }])

  .directive('errorMessage', ['gettextCatalog', function (gettextCatalog) {
    return {
      restrict : 'A',
      template: '<div class="alert alert-danger">' +
                  '<p><strong>' +
                  gettextCatalog.getString("V aplikaci bohužel nastala chyba.") +
                  '</strong></p>' +
                  '<ul><li>' +
                    gettextCatalog.getString('Pro vyřešení problému zkuste') +
                    ' <a href="" onClick="window.location.href=window.location.href" ' +
                        'class="btn btn-default">' +
                      gettextCatalog.getString('obnovit stránku') +
                    '</a>' +
                  '</li><li>' +
                    gettextCatalog.getString("Pokud problém přetrval zkuste to znovu později nebo") +
                    ' <a feedback-comment class="btn btn-default" email="{{email}}" href=""> ' +
                       gettextCatalog.getString('nám napiště')  +
                    '</a>' +
                  '</li></ul>' +
                '</div>',
    };
  }])

  .directive('pageNumber', ['gettextCatalog', function (gettextCatalog) {
    return {
      restrict : 'A',
      scope : true,
      template: '<span ng-show="pageNumber" class="page-number" > ' +
                gettextCatalog.getString('Zdroj') + ': ' +
                  ' <a href="http://anatomie.memorix.cz">' +
                  gettextCatalog.getString('Memorix anatomie') + '</a>, ' +
                  gettextCatalog.getString('str.') + ' {{pageNumber}}' +
                ' </span>',
      link : function($scope, elem, attrs) {
        $scope.pageNumber = attrs.pageNumber;
        attrs.$observe('pageNumber', function(value) {
          if (value) {
            $scope.pageNumber = value;
          }
        });
      },
    };
  }])

  .directive('showAfterXAnswers', ['$timeout', 'events', function($timeout, events) {
    return {
      scope : true,
      restrict : 'A',
      link : function($scope, elem, attrs) {
        var x = parseInt(attrs.showAfterXAnswers);
        events.on('userUpdated', function(user) {
          if (user.answered_count == x) {
            $timeout(function() {
              elem.tooltip({
                placement: 'right',
                title : elem.attr('tooltip'),
              });
              elem.tooltip('show');
            }, 100);
          }
        });
      }
    };
  }])

  .directive('isActive',['$location', '$rootScope',
      function($location, $rootScope) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        $rootScope.$on("$routeChangeSuccess", function() {
          var href = element.children('a').attr('href');
          if ($location.path() == href) {
            element.addClass('active');
          } else {
            element.removeClass('active');
          }
        });
      }
    };
  }])

  .directive('shareButton', ['shareModal', function(shareModal) {
    return {
      restrict: 'A',
      link: function (scope, element) {
        element.bind('click', function(){
          shareModal.open();
        });
      }
    };
  }])

  .directive('signInBanner', ['userService', 'signupModal',
      function(userService, signupModal) {
    return {
      restrict: 'A',
      templateUrl : 'static/tpl/sign_in_banner.html',
      link: function ($scope) {
        $scope.userService = userService;
        $scope.openSignupModal = function() {
            signupModal.open();
        };
      }
    };
  }])

  .directive('setCookieOnClick', ['$cookies', function($cookies) {
    return {
      restrict: 'A',
      link: function ($scope, element, attrs) {
        element.click(function() {
          $cookies[attrs.setCookieOnClick] = 'true';
        });
      }
    };
  }])

  .directive('countFrom', ['$interval', function($interval) {
    var stop; 
    return {
      restrict: 'A',
      template: '<span>{{count | number}}</span>',
      link: function ($scope, element, attrs) {
        if (angular.isDefined(stop)) {
          $interval.cancel(stop);
          stop = undefined;
        }

        $scope.count = attrs.countFrom;
        var step = 1000 / attrs.countPerSecond;

        if (attrs.countPerSecond > 0) {
          stop = $interval(function() {
            $scope.count++;
          }, step);
        }
      }
    };
  }])

  .directive('colorScaleLegend', [function() {
    return {
      restrict: 'A',
      replace: true,
      templateUrl : 'static/tpl/color_scale_legend.html',
      link: function ($scope) {
        $scope.values = [];
        for (var i = 1; i <= 10; i++) {
          $scope.values.push(i);
        }
      }
    };
  }])

  .directive('summary', ['practiceService', 'hotkeys', '$location',
      function(practiceService, hotkeys, $location) {
    return {
      restrict: 'A',
      replace: true,
      scope: {
        controller: '=controller',
        categoryId: '=categoryId',
        category2Id: '=category2Id',
      },
      templateUrl : 'static/tpl/summary_tpl.html',
      link: function ($scope) {
        $scope.summary = practiceService.getSummary();
        $scope.summary.correctlyAnsweredRatio = 
          $scope.summary.correct / $scope.summary.count;

        hotkeys.bindTo($scope).add({
          combo: 'enter',
          description: 'Pokračovat',
          callback: function() {
            var url = "/refreshpractice/" + ($scope.categoryId || "") +
              "/" + ($scope.category2Id || "");
            $location.url(url);
          }
        });

      },
    };
  }])

  .directive('optionButtons', ['$rootScope', 'serverLogger', 'hotkeys',
      function($rootScope, serverLogger, hotkeys) {
    return {
      restrict: 'A',
      scope: {
        question: '=question',
        imageController: '=imageController',
        canNext: '=canNext',
        controller: '=controller',
      },
      templateUrl : 'static/tpl/option_buttons_tpl.html',
      link: function ($scope) {
        
        function optionSelected(event, action) {
          var option = $scope.question && $scope.question.options && $scope.question.options[action.combo[0] - 1];
          if (option && ! option.disabled) {
            $scope.controller.checkAnswer(option.description, true);
          }
        }

        for (var i = 1; i <= 6; i++) {
          hotkeys.bindTo($scope)
          .add({
            combo: '' + i,
            description: 'Vybrat možnost ' + i,
            callback: optionSelected
          });
        }

        $rootScope.$on('questionAnswered', function() {
            highlightOptions();
        });

        function highlightOptions() {
            ($scope.question.options || []).map(function(o) {
                o.correct = o.term_secondary ? 
                  o.term_secondary.id == $scope.question.term_secondary.id :
                  o.description == $scope.question.description;
                o.selected = o.term_secondary ?
                  o.term_secondary.id == $scope.question.answered_term_secondary.id :
                  o.description == $scope.question.answered_code;
                if (o.selected || o.correct) {
                  o.bgcolor = undefined;
                  o.color = undefined;
                }
                o.disabled = true;
                return o;
            });
        }


      }
    };
  }])

  .directive('questionAndAnswer', [function() {
    return {
      restrict: 'A',
      scope: {
        question: '=question',
        imageController: '=imageController',
        clickFn: '=clickFn',
        categoryId: '=categoryId',
        category2Id: '=category2Id',
      },
      templateUrl : 'static/tpl/question_and_answer_tpl.html',
      link: function ($scope) {
        $scope.getFlashcardByDescription = function(description) {
          for (var i = 0; i < $scope.question.context.flashcards.length; i++) {
            var fc = $scope.question.context.flashcards[i];
            if (fc.description == description) {
              return fc;
            }
          }
        };
      },
    };
  }])

  .directive('practiceHeader', ['userService', function(userService) {
    return {
      restrict: 'A',
      replace: true,
      scope: {
        question: '=question',
        categoryId: '=categoryId',
      },
      templateUrl : 'static/tpl/practice_header_tpl.html',
      link: function ($scope) {
        $scope.userService = userService;
      }
    };
  }])

  .directive('practiceSetting', ['termsLanguageService',
      function(termsLanguageService) {
    return {
      restrict: 'A',
      replace: true,
      scope: {
        categoryId: '=categoryId',
        category2Id: '=category2Id',
      },
      templateUrl : 'static/tpl/practice_setting_tpl.html',
      link: function ($scope) {
        $scope.possibleLangs = termsLanguageService.getPossibleTermsLangs();
        $scope.setTermsLang = termsLanguageService.setTermsLang;
        $scope.getTermsLang = termsLanguageService.getTermsLang;
      }
    };
  }])

  .directive('practiceActionButtons', ['userService', 'hotkeys',
      function(userService, hotkeys) {
    return {
      restrict: 'A',
      replace: true,
      scope: {
        question: '=question',
        canNext: '=canNext',
        controller: '=controller',
      },
      templateUrl : 'static/tpl/practice_action_buttons_tpl.html',
      link: function ($scope) {
        $scope.userService = userService;

        hotkeys.bindTo($scope)
        .add({
          combo: 'enter',
          description: 'Pokračovat',
          callback: function() {
            if ($scope.canNext) {
              $scope.controller.next();
            }
          }
        });

      }
    };
  }])

  .directive('imageScreenShot', ['$rootScope', '$http', '$timeout',
      function($rootScope, $http, $timeout) {
    var screenshotTaken;
    return {
      restrict: 'A',
      replace: true,
      template : '<canvas style="display: none" id="screen-shot"></canvas> ',
      link: function () {
        function takeScreenshot(event, identifier) {
          if (screenshotTaken) {
            return;
          }
          var svg = document.querySelector( "svg" );
          var svgData = new XMLSerializer().serializeToString(svg);
          var canvas = document.getElementById("screen-shot");
          window.canvg(canvas, svgData);
          var imgSrc    = canvas.toDataURL("image/png");
          var data = {
            name : identifier,
            image : imgSrc,
          };
          $http.post('/savescreenshot/', data);
          screenshotTaken = true;
        }
        $rootScope.$on('imageDisplayed', function(event, identifier) {
          $timeout(function() {
            takeScreenshot(event, identifier);
          }, 500);
        });

      }
    };
  }])

  .directive('openQuestionsAlert', ['configService',
      function(configService) {
    return {
      restrict: 'A',
      replace: true,
      scope: {
      },
      templateUrl : 'static/tpl/open_questions_alert_tpl.html',
      link: function ($scope) {
        var restrictionKey = 'proso_models.option_selector.parameters.allow_zero_options_restriction';
        $scope.configService = configService;
        $scope.openQuestionsDisabled = configService.getOverridden()[restrictionKey];

        $scope.allowOpenQuestions = function() {
          configService.override(restrictionKey, false);
          $scope.openQuestionsDisabled = false;
        };
      }
    };
  }])

  .directive('openAnswer', ['flashcardService', 'configService', '$window', '$filter',
      function(flashcardService, configService, $window, $filter) {
    return {
      restrict: 'A',
      replace: true,
      scope: {
        question: '=question',
        canNext: '=canNext',
        controller: '=controller',
      },
      templateUrl : 'static/tpl/open_answer_tpl.html',
      link: function ($scope, element) {

        var question = angular.copy($scope.question);
        if (question.term_secondary && question.question_type == 't2ts') {
            question.term = question.term_secondary;
        }
        $scope.flashcards = [question];
        flashcardService.getFlashcards({}).then(function(flashcards) {
          var fcByDescription = {};
          flashcards = flashcards.filter(function(fc) {
              if ((fc.description && fcByDescription[fc.description]) || !fc.term) {
                  return false;
              }
              fcByDescription[fc.description] = true;
              return true;
          });
          $scope.flashcards = flashcards.filter(function(f) {
              return !(question.question_type == 't2ts' && f.term.name == question.term.name && !f.term_secondary);
            }).map(function(f) {
            if (question.question_type == 't2ts' && f.term_secondary) {
              f.term = f.term_secondary;
            }
            f.term.primaryName = $filter('stripAlternatives')(f.term && f.term.name);
            return f;
          }).sort(function(a, b){
              return a.term.primaryName.length - b.term.primaryName.length; 
          });
        });

        $scope.canAnswer = function() {
          return !$scope.canNext && $scope.answer && (
            $scope.answer.description || $scope.answer.term_secondary);
        };
        $scope.checkAnswer = function(keyboardUsed) {
          if ($scope.canAnswer()) {
            if ($scope.question.description != $scope.answer.description &&
                $scope.question.term.name == $scope.answer.term.name) {
              $scope.answer = $scope.question;
            }
            $scope.controller.checkAnswer($scope.answer, keyboardUsed);
            if ($scope.question.description == $scope.answer.description) {
              $scope.question.isCorrect = true;
            } else {
              $scope.question.isIncorrect = true;
            }
          }
        };
        $scope.disableOpenQuestions = function() {
          var restrictionKey = 'proso_models.option_selector.parameters.allow_zero_options_restriction';
          configService.override(restrictionKey, true);
          $window.location.reload();
        };

        element.children('input').focus();
        $scope.inputKeypress = function($event) {
          if ($event.which == 13) {
            $scope.checkAnswer(true);
          }
        };
      }
    };
  }]);
