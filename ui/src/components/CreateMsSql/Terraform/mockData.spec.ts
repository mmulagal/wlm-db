import { describe, it, expect } from 'vitest';
import { code } from './mockData';

describe('mockData', () => {
    it('code is a non-empty string', () => {
        expect(typeof code).toBe('string');
        expect(code.length).toBeGreaterThan(0);
    });

    it('contains terraform provider block', () => {
        expect(code).toContain('terraform {');
        expect(code).toContain('required_providers');
        expect(code).toContain('hashicorp/aws');
    });

    it('contains locals block', () => {
        expect(code).toContain('locals {');
        expect(code).toContain('new_ontap_fsx');
        expect(code).toContain('is_standalone');
    });

    it('contains provider aws block', () => {
        expect(code).toContain('provider "aws"');
        expect(code).toContain('var.aws_location');
    });

    it('contains variable declarations', () => {
        expect(code).toContain('variable "aws_location"');
        expect(code).toContain('variable "vpc_id"');
        expect(code).toContain('variable "deployment_name"');
        expect(code).toContain('variable "sql_deployment_mode"');
    });

    it('contains module declarations', () => {
        expect(code).toContain('module "vpc-endpoints"');
        expect(code).toContain('module "validation-node"');
        expect(code).toContain('module "fsxn"');
        expect(code).toContain('module "ec2"');
    });

    it('contains fsx variables', () => {
        expect(code).toContain('variable "fsx_file_system_name"');
        expect(code).toContain('variable "fsx_storage_capacity"');
        expect(code).toContain('variable "fsx_encryption_key"');
    });

    it('contains sql configuration variables', () => {
        expect(code).toContain('variable "sql_ami_id"');
        expect(code).toContain('variable "sql_collation"');
        expect(code).toContain('variable "sql_server_name"');
    });

    it('references correct deployment mode SINGLE_AZ_1', () => {
        expect(code).toContain('SINGLE_AZ_1');
    });

    it('contains CloudWatch variable', () => {
        expect(code).toContain('variable "enable_cloud_watch_log_feature"');
    });
});
