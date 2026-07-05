// Thin typed HTTP client for the CashflowKub API.
// Dart port of mobile/src/lib/api.ts.
//
// Base URL resolution: `apiEndpoint` from constants.dart (override at run time
// with --dart-define=API_URL=...). All calls are prefixed with `/api/v1`.

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../constants.dart';

/// Thrown when the API responds with a non-2xx status.
class ApiError implements Exception {
  final int status;
  final String message;

  ApiError(this.status, this.message);

  @override
  String toString() => 'ApiError($status): $message';
}

class ApiClient {
  ApiClient({String? baseUrl, http.Client? client})
      : _base = _trimTrailingSlash(baseUrl ?? apiEndpoint),
        _http = client ?? http.Client();

  final String _base;
  final http.Client _http;

  String get _api => '$_base/api/v1';

  static String _trimTrailingSlash(String url) =>
      url.endsWith('/') ? url.substring(0, url.length - 1) : url;

  static const _jsonHeaders = {'Content-Type': 'application/json'};

  /// Performs a request and decodes the JSON body. Returns `null` for 204.
  Future<dynamic> _request(
    String method,
    String path, {
    Object? body,
  }) async {
    final uri = Uri.parse('$_api$path');
    final request = http.Request(method, uri)..headers.addAll(_jsonHeaders);
    if (body != null) request.body = jsonEncode(body);

    final streamed = await _http.send(request);
    final res = await http.Response.fromStream(streamed);

    if (res.statusCode < 200 || res.statusCode >= 300) {
      var message = 'Request failed (${res.statusCode})';
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map && decoded['error'] != null) {
          message = decoded['error'].toString();
        }
      } catch (_) {
        // non-JSON error body
      }
      throw ApiError(res.statusCode, message);
    }

    if (res.statusCode == 204 || res.body.isEmpty) return null;
    return jsonDecode(res.body);
  }

  Future<dynamic> get(String path) => _request('GET', path);
  Future<dynamic> post(String path, [Object? body]) =>
      _request('POST', path, body: body);
  Future<dynamic> put(String path, [Object? body]) =>
      _request('PUT', path, body: body);
  Future<dynamic> patch(String path, [Object? body]) =>
      _request('PATCH', path, body: body);
  Future<dynamic> del(String path) => _request('DELETE', path);

  /// GET an endpoint that wraps its array payload in `{ data: [...] }`.
  Future<List<Map<String, dynamic>>> getList(String path) async {
    final res = await get(path);
    final data = res is Map ? res['data'] : null;
    if (data is! List) return const [];
    return data.map((e) => (e as Map).cast<String, dynamic>()).toList();
  }

  void close() => _http.close();
}
