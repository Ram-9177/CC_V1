import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _profile;
  String? _role;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('authToken');
      final userId = prefs.getString('userId');
      final role = prefs.getString('role');
      _role = role;
      if (token == null || userId == null) throw Exception('Missing auth');
      final apiUrl = const String.fromEnvironment('API_URL', defaultValue: 'http://localhost:3000');
      final res = await http.get(Uri.parse('$apiUrl/users/$userId'), headers: { 'Authorization': 'Bearer $token' });
      if (res.statusCode == 200) {
        setState(() { _profile = jsonDecode(res.body) as Map<String, dynamic>; });
      } else {
        setState(() { _error = 'HTTP ${res.statusCode}'; });
      }
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Profile')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: _loading ? const Center(child: CircularProgressIndicator()) :
          _error != null ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red))) :
          ListView(
            children: [
              Row(children: [
                const Text('Role: ', style: TextStyle(fontWeight: FontWeight.bold)),
                Text(_role ?? '-')
              ]),
              const SizedBox(height: 8),
              _row('Hallticket', _profile?['hallticket']),
              _row('Name', '${_profile?['firstName'] ?? ''} ${_profile?['lastName'] ?? ''}'),
              _row('Email', _profile?['email']),
              _row('Phone', _profile?['phoneNumber']),
              _row('Hostel Block', _profile?['hostelBlock']),
              _row('Room Number', _profile?['roomNumber']),
              _row('Bed Label', _profile?['bedLabel']),
            ],
          ),
      ),
    );
  }

  Widget _row(String label, dynamic value) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.black54)),
          Text(value?.toString() ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
