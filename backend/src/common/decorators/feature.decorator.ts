import { SetMetadata } from '@nestjs/common';

export const FEATURES_KEY = 'features';
export const Feature = (featureKey: string) => SetMetadata(FEATURES_KEY, [featureKey]);
export const Features = (...featureKeys: string[]) => SetMetadata(FEATURES_KEY, featureKeys);
