import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot() { return { message: 'Welcome to Hapke' }; }

  // For tests: keep classic Nest starter contract
  getHello() { return this.appService.getHello(); }
}

@Controller('restaurants')
export class RestaurantsController {
  @Get()
  list() {
    return [
      { id: 'r1', name: 'Pizzeria Napoli', cuisine: 'Italiaans • Pizza', rating: 4.6, minOrder: 15, deliveryCost: 0 },
      { id: 'r2', name: 'Sushi Nijmeegs',  cuisine: 'Japans • Sushi',    rating: 4.4, minOrder: 20, deliveryCost: 1.5 },
    ];
  }

  @Get(':id/menu')
  menu(@Param('id') id: string) {
    if (id === 'r1') {
      return [
        { id: 'm1', title: 'Margherita', description: 'Tomaat, mozzarella, basilicum', price: 9.5 },
        { id: 'm2', title: 'Quattro Formaggi', description: 'Vier kazen, romig & rijk', price: 12.5 },
        { id: 'm3', title: 'Tiramisu', description: 'Huisgemaakt dessert', price: 6.5 },
        { id: 'm15', title: 'Pizza Pepperoni', description: 'Pepperoni, mozzarella, tomaat', price: 11.5 },
        { id: 'm16', title: 'Lasagne', description: 'Laagjes pasta, gehakt, bechamelsaus', price: 12.0 },
      ];
    }
    if (id === 'r2') {
      return [
        { id: 'm4', title: 'Salmon Maki (8st)', description: 'Zalm, nori, rijst', price: 8.95 },
        { id: 'm5', title: 'Spicy Tuna Roll', description: 'Tonijn met pit', price: 11.95 },
        { id: 'm6', title: 'Gyoza (6st)', description: 'Kip & groente', price: 6.75 },
        { id: 'm17', title: 'California Roll', description: 'Krab, avocado, komkommer', price: 9.95 },
        { id: 'm18', title: 'Ebi Tempura', description: 'Gefrituurde garnaal, saus', price: 10.95 },
      ];
    }
    return [];
  }
}
