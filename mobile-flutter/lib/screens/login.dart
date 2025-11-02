import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _hallticketCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      final apiUrl = const String.fromEnvironment('API_URL', defaultValue: 'http://localhost:3000');
      final res = await http.post(Uri.parse('$apiUrl/auth/login'), headers: { 'Content-Type': 'application/json' },
        body: jsonEncode({ 'hallticket': _hallticketCtrl.text.trim().toUpperCase(), 'password': _passwordCtrl.text })) ;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final json = jsonDecode(res.body) as Map<String, dynamic>;
        final token = json['accessToken'] as String?;
        final user = json['user'] as Map<String, dynamic>?;
        if (token != null && user != null) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('authToken', token);
          await prefs.setString('userId', user['id'] as String? ?? '');
          await prefs.setString('role', user['role'] as String? ?? 'STUDENT');
          if (context.mounted) Navigator.of(context).pushReplacementNamed('/profile');
          return;
        }
      }
      setState(() { _error = 'Invalid login'; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Login')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _hallticketCtrl,
                decoration: const InputDecoration(labelText: 'Hallticket'),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _passwordCtrl,
                decoration: const InputDecoration(labelText: 'Password'),
                obscureText: true,
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 16),
              if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: _loading ? null : _login,
                child: _loading ? const CircularProgressIndicator() : const Text('Sign In'),
              )
            ],
          ),
        ),
      ),
    );
  }
}
