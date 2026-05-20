import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';

@Global() // Makes EmailService injectable anywhere without re-importing
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
