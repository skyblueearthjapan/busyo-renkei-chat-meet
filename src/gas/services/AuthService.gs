/**
 * AuthService - 認証サービス
 *
 * ユーザー情報の取得とアクセス制御を提供
 */
var AuthService = (function() {

  /**
   * 現在のユーザー情報を取得
   * @returns {Object} ユーザー情報 {email, name}
   */
  function getCurrentUser() {
    var email = Session.getActiveUser().getEmail();

    // メールアドレスから表示名を推測
    // 実際の運用ではディレクトリAPIやスプレッドシートのユーザーマスタから取得
    var name = email ? email.split('@')[0] : 'ゲスト';

    // 名前をより読みやすく変換（例: tanaka.taro → 田中太郎）
    // 実運用時はPeople API等で正式名を取得することを推奨
    name = formatDisplayName(name);

    return {
      email: email || '',
      name: name
    };
  }

  /**
   * メールアドレスのローカル部分を表示名に整形
   * @param {string} localPart - メールアドレスのローカル部分
   * @returns {string} 整形された表示名
   */
  function formatDisplayName(localPart) {
    if (!localPart) return 'ゲスト';

    // ドットやアンダースコアで区切ってキャピタライズ
    var parts = localPart.split(/[._-]/);
    var formatted = parts.map(function(part) {
      if (part.length === 0) return '';
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');

    return formatted || localPart;
  }

  /**
   * ユーザーが許可されたドメインに属しているか確認
   * @param {string} allowedDomain - 許可するドメイン（例: 'example.com'）
   * @returns {boolean} 許可されているかどうか
   */
  function isAllowedDomain(allowedDomain) {
    var email = Session.getActiveUser().getEmail();
    if (!email) return false;

    var domain = email.split('@')[1];
    return domain === allowedDomain;
  }

  /**
   * ユーザーがアクセス許可されているか確認（エラー時は例外）
   * @param {string} allowedDomain - 許可するドメイン（任意）
   */
  function assertAllowedUser(allowedDomain) {
    var email = Session.getActiveUser().getEmail();

    if (!email) {
      throw new Error('ログインが必要です。Googleアカウントでログインしてください。');
    }

    if (allowedDomain && !isAllowedDomain(allowedDomain)) {
      throw new Error('このアプリケーションへのアクセス権がありません。');
    }
  }

  /**
   * 現在のユーザーが特定のメールアドレスリストに含まれているか確認
   * @param {Array} allowedEmails - 許可するメールアドレスの配列
   * @returns {boolean} 含まれているかどうか
   */
  function isAllowedEmail(allowedEmails) {
    var email = Session.getActiveUser().getEmail();
    if (!email) return false;

    return allowedEmails.indexOf(email.toLowerCase()) >= 0;
  }

  /**
   * 管理者かどうか確認
   * スクリプトプロパティの 'adminEmails' から判定
   * @returns {boolean} 管理者かどうか
   */
  function isAdmin() {
    var props = PropertiesService.getScriptProperties();
    var adminEmailsStr = props.getProperty('adminEmails') || '';
    if (!adminEmailsStr) return false;

    var adminEmails = adminEmailsStr.split(',').map(function(e) {
      return e.trim().toLowerCase();
    });

    return isAllowedEmail(adminEmails);
  }

  // 公開API
  return {
    getCurrentUser: getCurrentUser,
    isAllowedDomain: isAllowedDomain,
    assertAllowedUser: assertAllowedUser,
    isAllowedEmail: isAllowedEmail,
    isAdmin: isAdmin
  };
})();
