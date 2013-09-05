(function(w) {
  'use strict';
  var angular = w.angular;
  var FirefoxOS = angular.module('FirefoxOS', []);

  FirefoxOS.factory('systemXHR', [
    '$rootScope', '$q',
    function($rootScope, $q) {

      function getXHRResponse(xhr) {
        return xhr.responseJSON ||
          xhr.responseXML ||
          xhr.response;
      };

      function errorHandler(deferred) {
        var xhr = this;
        return $rootScope.$apply(function() {
          return deferred.reject(xhr.status, xhr);
        });
      }

      function loadHandler(deferred) {
        var xhr = this;
        return $rootScope.$apply(function() {
           return deferred.resolve(getXHRResponse(xhr));
        });
      }

      function progressHandler(deferred, evt) {
        var xhr = this;
        return $rootScope.$apply(function() {
          if (evt.lengthComputable) {
            return deferred.notify(evt.loaded / evt.total, xhr);
          } else {
            return deferred.notify(-1, xhr);
          }
        });
      }

      return function(url, opts) {

        opts = opts || {};

        var deferred = $q.defer();
        var xhr = new XMLHttpRequest({mozSystem: true});
        xhr.addEventListener(
          'load',
          loadHandler.bind(xhr, deferred),
          false
        );
        xhr.addEventListener(
          'error',
          errorHandler.bind(xhr, deferred),
          false
        );
        /*xhr.addEventListener(
          'progress',
          progressHandler.bind(xhr, deferred),
          false
        );*/
        xhr.responseType = opts.responseType;
        xhr.open(opts.method || 'get', url, true);
        xhr.send();

        return deferred.promise;
        
      };

    }
  ]);
}(window))