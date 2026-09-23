import { PartialType } from '@nestjs/swagger';
import { CreateListingDto } from './create-listing.dto';

/**
 * Every field is optional, but `location` still requires both coordinates when
 * it is sent, so a listing can never end up with half an address.
 */
export class UpdateListingDto extends PartialType(CreateListingDto) {}
