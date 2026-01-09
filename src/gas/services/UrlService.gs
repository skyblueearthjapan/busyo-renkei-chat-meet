/**
 * UrlService.gs - URLµüÓ¹
 *
 * Web¢×êURLnh¯¨êÑéáü¿nØ’Ğ›
 */

var UrlService = (function() {

  /**
   * Web¢×ênURL’
   * @param {Object} params - ¯¨êÑéáü¿
   * @returns {string} ŒhjURL
   */
  function buildWebAppUrl(params) {
    var base = getWebAppBaseUrl();
    params = params || {};

    var queryParts = [];
    for (var key in params) {
      if (params.hasOwnProperty(key)) {
        var value = params[key];
        // undefined, null, '' od
        if (value !== undefined && value !== null && value !== '') {
          queryParts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
        }
      }
    }

    var query = queryParts.join('&');
    return base + (query ? ('?' + query) : '');
  }

  /**
   * Web¢×ênÙü¹URL’Ö—
   * @returns {string} Ùü¹URL
   */
  function getWebAppBaseUrl() {
    try {
      return ScriptApp.getService().getUrl();
    } catch (e) {
      console.error('getWebAppBaseUrl ¨éü:', e);
      // Õ©üëĞÃ¯: z‡W’ÔYøşURLkj‹	
      return '';
    }
  }

  /**
   * áâÚü¸xnURL’
   * @param {Object} options - { eventId, fromDeptId, toDeptId }
   * @returns {string} áâÚü¸URL
   */
  function buildMemoUrl(options) {
    options = options || {};
    return buildWebAppUrl({
      page: 'memo',
      event_id: options.eventId || '',
      from: options.fromDeptId || '',
      to: options.toDeptId || ''
    });
  }

  /**
   * s0Úü¸xnURL’
   * @param {string} memoId - áâID
   * @returns {string} s0Úü¸URL
   */
  function buildDetailUrl(memoId) {
    return buildWebAppUrl({
      page: 'detail',
      memo_id: memoId
    });
  }

  /**
   * etÚü¸xnURL’
   * @param {Object} filters - Õ£ë¿aöû	
   * @returns {string} etÚü¸URL
   */
  function buildHistoryUrl(filters) {
    var params = { page: 'history' };
    if (filters) {
      if (filters.status) params.status = filters.status;
      if (filters.issueType) params.type = filters.issueType;
    }
    return buildWebAppUrl(params);
  }

  /**
   * ÛüàÚü¸xnURL’
   * @returns {string} ÛüàÚü¸URL
   */
  function buildHomeUrl() {
    return buildWebAppUrl({ page: 'home' });
  }

  // l‹API
  return {
    buildWebAppUrl: buildWebAppUrl,
    getWebAppBaseUrl: getWebAppBaseUrl,
    buildMemoUrl: buildMemoUrl,
    buildDetailUrl: buildDetailUrl,
    buildHistoryUrl: buildHistoryUrl,
    buildHomeUrl: buildHomeUrl
  };
})();
