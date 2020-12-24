import React, { memo, useMemo } from 'react';
import {
  BaselineAlignment,
  CheckPagePermissions,
  SizedInput,
  useUserPermissions,
} from 'strapi-helper-plugin';
import { useIntl } from 'react-intl';
import { getRequestUrl } from '../../../../../admin/src/utils';
import PageTitle from '../../../../../admin/src/components/SettingsPageTitle';
import ContainerFluid from '../../../../../admin/src/components/ContainerFluid';
import FormBloc from '../../../../../admin/src/components/FormBloc';
import { Header } from '../../../../../admin/src/components/Settings';
import { useRolesList, useSettingsForm } from '../../../../../admin/src/hooks';
import adminPermissions from '../../../../../admin/src/permissions';
import { form, schema } from './utils';

const ssoPermissions = {
  ...adminPermissions.settings.sso,
  readRoles: adminPermissions.settings.roles.read,
};

const SingleSignOn = () => {
  const { formatMessage } = useIntl();
  const {
    isLoading: isLoadingForPermissions,
    allowedActions: { canUpdate, canReadRoles },
  } = useUserPermissions(ssoPermissions);

  const [
    { formErrors, initialData, isLoading, modifiedData, showHeaderButtonLoader },
    // eslint-disable-next-line no-unused-vars
    dispatch,
    { handleCancel, handleChange, handleSubmit },
  ] = useSettingsForm(getRequestUrl('providers/options'), schema, () => {}, [
    'autoRegister',
    'defaultRole',
  ]);
  const { roles } = useRolesList(canReadRoles);

  const showLoader = useMemo(() => isLoadingForPermissions || isLoading, [
    isLoading,
    isLoadingForPermissions,
  ]);

  const options = useMemo(() => {
    return [
      <option key="placeholder" disabled value="">
        {formatMessage({ id: 'components.InputSelect.option.placeholder' })}
      </option>,
      ...roles.map(({ id, name }) => (
        <option key={id} value={id}>
          {name}
        </option>
      )),
    ];
  }, [roles, formatMessage]);

  return (
    <>
      <PageTitle name="SSO" />
      <form onSubmit={handleSubmit}>
        <ContainerFluid padding="0">
          <Header
            isLoading={showLoader}
            initialData={initialData}
            label={formatMessage({ id: 'Settings.sso.title' })}
            modifiedData={modifiedData}
            onCancel={handleCancel}
            content={formatMessage({ id: 'Settings.sso.description' })}
            showHeaderButtonLoader={showHeaderButtonLoader}
          />
          <BaselineAlignment top size="3px" />
          <FormBloc isLoading={showLoader}>
            {Object.keys(form).map(key => {
              return (
                <SizedInput
                  {...form[key]}
                  key={key}
                  disabled={!canUpdate}
                  error={formErrors[key]}
                  name={key}
                  onChange={handleChange}
                  options={options}
                  value={modifiedData[key]}
                />
              );
            })}
          </FormBloc>
        </ContainerFluid>
      </form>
    </>
  );
};

const ProtectedSSO = () => (
  <CheckPagePermissions permissions={ssoPermissions.main}>
    <SingleSignOn />
  </CheckPagePermissions>
);

export default memo(ProtectedSSO);
