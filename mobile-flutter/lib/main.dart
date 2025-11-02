import 'package:flutter/material.dart';
import 'screens/login.dart';
import 'screens/profile.dart';

void main() {
  runApp(const HostelConnectApp());
}

class HostelConnectApp extends StatelessWidget {
  const HostelConnectApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'HostelConnect',
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.indigo),
      routes: {
        '/': (context) => const LoginScreen(),
        '/profile': (context) => const ProfileScreen(),
      },
      initialRoute: '/',
    );
  }
}
