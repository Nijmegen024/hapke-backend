import { Body, Controller, Get, Patch, Post, Param, Query, UnauthorizedException, Req } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

@Controller('vendor')
export class VendorController {
  constructor(private jwt: JwtService) {}

  @Post('login')
  async login(@Body() body: any) {
    const { email, password } = body
    if (!email || !password) throw new UnauthorizedException('Email en wachtwoord verplicht')
    const token = await this.jwt.signAsync({ sub: email, role: 'vendor', restaurantId: 'r1' })
    return { token }
  }

  @Get('orders')
  async getOrders(@Req() req: any, @Query('status') status?: string) {
    this.decode(req)
    return [] // test endpoint
  }

  @Patch('orders/:id/status')
  async updateStatus(@Req() req: any, @Param('id') id: string, @Body('status') status: string) {
    this.decode(req)
    return { ok: true }
  }

  private decode(req: any) {
    const auth = req.headers['authorization'] || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) throw new UnauthorizedException('Geen token')
    const payload = this.jwt.decode(token) as any
    if (!payload || payload.role !== 'vendor') throw new UnauthorizedException('Token ongeldig')
    return payload
  }
}
