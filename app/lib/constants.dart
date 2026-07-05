import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

/// Base URL of the CashflowKub API.
///
/// Override at build/run time with:
///   flutter run --dart-define=API_URL=http://192.168.1.10:8080
///
/// Defaults to the Android emulator loopback (10.0.2.2 -> host machine).
/// Use http://localhost:8080 for iOS simulator / desktop / web.
String get apiEndpoint {
  const envUrl = String.fromEnvironment('API_URL');
  if (envUrl.isNotEmpty) {
    return envUrl;
  }
  if (kIsWeb) {
    return 'http://localhost:8080';
  }
  try {
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:8080';
    }
  } catch (_) {
    // Fallback if Platform throws (e.g. on certain web or restricted environments)
  }
  return 'http://localhost:8080';
}

