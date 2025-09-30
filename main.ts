import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'restaurant_detail.dart';

const String baseUrl = 'http://localhost:3000';

void main() {
  runApp(const HapkeApp());
}

class HapkeApp extends StatelessWidget {
  const HapkeApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hapke',
      debugShowCheckedModeBanner: false,
      home: const RestaurantsPage(),
    );
  }
}

class Restaurant {
  final String id;
  final String name;
  final String cuisine;
  final double rating;
  final num minOrder;
  final num deliveryCost;

  Restaurant({
    required this.id,
    required this.name,
    required this.cuisine,
    required this.rating,
    required this.minOrder,
    required this.deliveryCost,
  });

  factory Restaurant.fromJson(Map<String, dynamic> j) => Restaurant(
        id: j['id'] as String,
        name: j['name'] as String,
        cuisine: j['cuisine'] as String,
        rating: (j['rating'] as num).toDouble(),
        minOrder: j['minOrder'] as num,
        deliveryCost: j['deliveryCost'] as num,
      );
}

class RestaurantsPage extends StatefulWidget {
  const RestaurantsPage({super.key});
  @override
  State<RestaurantsPage> createState() => _RestaurantsPageState();
}

class _RestaurantsPageState extends State<RestaurantsPage> {
  late Future<List<Restaurant>> _future;

  @override
  void initState() {
    super.initState();
    _future = _fetchRestaurants();
  }

  Future<List<Restaurant>> _fetchRestaurants() async {
    final uri = Uri.parse('$baseUrl/restaurants');
    final res = await http.get(uri);
    if (res.statusCode != 200) {
      throw Exception('HTTP ${res.statusCode}: ${res.body}');
    }
    final data = json.decode(res.body) as List<dynamic>;
    return data
        .map((e) => Restaurant.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> _reload() async {
    setState(() {
      _future = _fetchRestaurants();
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Restaurants')),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: FutureBuilder<List<Restaurant>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ListView(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      'Fout: ${snap.error}',
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                ],
              );
            }
            final items = snap.data ?? [];
            if (items.isEmpty) {
              return ListView(
                children: const [ListTile(title: Text('Geen restaurants'))],
              );
            }
            return ListView.separated(
              itemCount: items.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final r = items[i];
                return ListTile(
                  title: Text(r.name),
                  subtitle: Text('${r.cuisine} • ⭐ ${r.rating.toStringAsFixed(1)}'),
                  trailing: Text('€${r.deliveryCost} • min €${r.minOrder}'),
                  onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => RestaurantDetail(
                        id: r.id,
                        name: r.name,
                        subtitle: '${r.cuisine} • ⭐ ${r.rating.toStringAsFixed(1)}',
                      ),
                    ));
                  },
                );
              },
            );
          },
        ),
      ),
    );
  }
}
